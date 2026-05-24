import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { Note } from './entities/note.entity';
import { Tag } from '../tags/entities/tag.entity';
import {
  buildCreateNotePayload,
  noteByIdWhere,
  noteCreatedResponse,
  noteDeletedResponse,
  noteFetchedResponse,
  NotesFilterEnum,
  NoteFilters,
  normalizeNoteStatus,
  resolveOwnedTags,
} from './notes.helper';
import type { JwtUser } from '../tags/tags.helper';

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly noteRepository: Repository<Note>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createNoteDto: CreateNoteDto, user: JwtUser) {
    const tags = await resolveOwnedTags(
      this.tagRepository,
      createNoteDto.tagIds,
      user,
    );

    const note = this.noteRepository.create(
      {
        ...buildCreateNotePayload(
          createNoteDto.title,
          createNoteDto.content ?? null,
          tags,
          user,
        ),
        ...normalizeNoteStatus(
          { isFavourite: false, isArchived: false },
          {
            isFavourite: createNoteDto.isFavourite,
            isArchived: createNoteDto.isArchived,
          },
        ),
      },
    );

    const savedNote = await this.noteRepository.save(note);

    return noteCreatedResponse(savedNote);
  }

  async findAll(user: JwtUser, filters: NoteFilters = {}) {
    const queryBuilder = this.noteRepository
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.tags', 'tag')
      .where('note.userId = :userId', { userId: user.id })
      .orderBy('note.createdAt', 'DESC')
      .distinct(true);

    if (filters.tagId) {
      queryBuilder.andWhere('tag.id = :tagId', { tagId: filters.tagId });
    }

    const searchTerm = filters.search?.trim();

    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`;

      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('note.title ILIKE :search', {
            search: searchPattern,
          })
            .orWhere('note.content ILIKE :search', {
              search: searchPattern,
            })
            .orWhere('tag.name ILIKE :search', {
              search: searchPattern,
            });
        }),
      );
    }

    if (filters.filter === NotesFilterEnum.ALL) {
      queryBuilder.andWhere('note.isArchived = :isArchived', {
        isArchived: false,
      });
    }

    if (filters.filter === NotesFilterEnum.FAVOURITES) {
      queryBuilder.andWhere('note.isFavourite = :isFavourite', {
        isFavourite: true,
      });
    }

    if (filters.filter === NotesFilterEnum.ARCHIVED) {
      queryBuilder.andWhere('note.isArchived = :isArchived', {
        isArchived: true,
      });
    }

    const notes = await queryBuilder.getMany();

    return noteFetchedResponse('Notes fetched successfully', notes);
  }

  async findOne(id: string, user: JwtUser) {
    const note = await this.noteRepository.findOne({
      where: noteByIdWhere(id, user.id),
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return noteFetchedResponse('Note fetched successfully', note);
  }

  async update(id: string, updateNoteDto: UpdateNoteDto, user: JwtUser) {
    const note = await this.noteRepository.findOne({
      where: noteByIdWhere(id, user.id),
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const tags =
      updateNoteDto.tagIds !== undefined
        ? await resolveOwnedTags(this.tagRepository, updateNoteDto.tagIds, user)
        : note.tags;

    note.title = updateNoteDto.title ?? note.title;
    note.content =
      updateNoteDto.content !== undefined ? updateNoteDto.content : note.content;
    note.tags = tags;
    const nextStatus = normalizeNoteStatus(
      {
        isFavourite: note.isFavourite,
        isArchived: note.isArchived,
      },
      {
        isFavourite: updateNoteDto.isFavourite,
        isArchived: updateNoteDto.isArchived,
      },
    );

    note.isFavourite = nextStatus.isFavourite;
    note.isArchived = nextStatus.isArchived;

    const updatedNote = await this.noteRepository.save(note);

    return noteFetchedResponse('Note updated successfully', updatedNote);
  }

  async remove(id: string, user: JwtUser) {
    await this.dataSource.transaction(async (manager) => {
      const noteRepository = manager.getRepository(Note);
      const tagRepository = manager.getRepository(Tag);

      const note = await noteRepository.findOne({
        where: noteByIdWhere(id, user.id),
      });

      if (!note) {
        throw new NotFoundException('Note not found');
      }

      const tagIds = note.tags.map((tag) => tag.id);

      await noteRepository.remove(note);

      if (tagIds.length > 0) {
        const orphanTagRows = await tagRepository
          .createQueryBuilder('tag')
          .select('tag.id', 'id')
          .leftJoin('tag.notes', 'note')
          .where('tag.id IN (:...tagIds)', { tagIds })
          .groupBy('tag.id')
          .having('COUNT(note.id) = 0')
          .getRawMany();

        const orphanTagIds = orphanTagRows.map((row) => row.id as string);

        if (orphanTagIds.length > 0) {
          await tagRepository.delete(orphanTagIds);
        }
      }
    });

    return noteDeletedResponse('Note deleted successfully');
  }
}

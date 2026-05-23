import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async create(createNoteDto: CreateNoteDto, user: JwtUser) {
    const tags = await resolveOwnedTags(
      this.tagRepository,
      createNoteDto.tagIds,
      user,
    );

    const note = this.noteRepository.create(
      buildCreateNotePayload(
        createNoteDto.title,
        createNoteDto.content ?? null,
        tags,
        user,
        createNoteDto.isFavourite ?? false,
        createNoteDto.isArchived ?? false,
      ),
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
    note.isFavourite =
      updateNoteDto.isFavourite !== undefined
        ? updateNoteDto.isFavourite
        : note.isFavourite;
    note.isArchived =
      updateNoteDto.isArchived !== undefined
        ? updateNoteDto.isArchived
        : note.isArchived;

    const updatedNote = await this.noteRepository.save(note);

    return noteFetchedResponse('Note updated successfully', updatedNote);
  }

  async remove(id: string, user: JwtUser) {
    const note = await this.noteRepository.findOne({
      where: noteByIdWhere(id, user.id),
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    await this.noteRepository.remove(note);

    return noteDeletedResponse('Note deleted successfully');
  }
}

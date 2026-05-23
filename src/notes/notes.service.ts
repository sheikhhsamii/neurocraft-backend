import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { Note } from './entities/note.entity';
import { Tag } from '../tags/entities/tag.entity';
import { JwtUser, tagOwnerWhere } from '../tags/tags.helper';

type NoteFilters = {
  tagId?: string;
  archived?: boolean;
  favourite?: boolean;
};

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly noteRepository: Repository<Note>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  private async resolveTags(tagIds?: string[], user?: JwtUser) {
    if (!tagIds || tagIds.length === 0) {
      return [];
    }

    const uniqueTagIds = [...new Set(tagIds)];
    const tags = await this.tagRepository.find({
      where: uniqueTagIds.map((id) => ({
        id,
        ...(user ? tagOwnerWhere(user.id) : {}),
      })),
    });

    if (tags.length !== uniqueTagIds.length) {
      throw new NotFoundException('One or more tags were not found');
    }

    return tags;
  }

  async create(createNoteDto: CreateNoteDto, user: JwtUser) {
    const tags = await this.resolveTags(createNoteDto.tagIds, user);

    const note = this.noteRepository.create({
      title: createNoteDto.title,
      content: createNoteDto.content ?? null,
      user,
      tags,
      isFavourite: createNoteDto.isFavourite ?? false,
      isArchived: createNoteDto.isArchived ?? false,
    });

    const savedNote = await this.noteRepository.save(note);

    return {
      statusCode: 201,
      status: 'success',
      message: 'Note created successfully',
      data: savedNote,
    };
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

    if (typeof filters.archived === 'boolean') {
      queryBuilder.andWhere('note.isArchived = :isArchived', {
        isArchived: filters.archived,
      });
    }

    if (typeof filters.favourite === 'boolean') {
      queryBuilder.andWhere('note.isFavourite = :isFavourite', {
        isFavourite: filters.favourite,
      });
    }

    const notes = await queryBuilder.getMany();

    return {
      statusCode: 200,
      status: 'success',
      message: 'Notes fetched successfully',
      data: notes,
    };
  }

  async findOne(id: string, user: JwtUser) {
    const note = await this.noteRepository.findOne({
      where: {
        id,
        user: {
          id: user.id,
        },
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return {
      statusCode: 200,
      status: 'success',
      message: 'Note fetched successfully',
      data: note,
    };
  }

  async update(id: string, updateNoteDto: UpdateNoteDto, user: JwtUser) {
    const note = await this.noteRepository.findOne({
      where: {
        id,
        user: {
          id: user.id,
        },
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    const tags =
      updateNoteDto.tagIds !== undefined
        ? await this.resolveTags(updateNoteDto.tagIds, user)
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

    return {
      statusCode: 200,
      status: 'success',
      message: 'Note updated successfully',
      data: updatedNote,
    };
  }

  async remove(id: string, user: JwtUser) {
    const note = await this.noteRepository.findOne({
      where: {
        id,
        user: {
          id: user.id,
        },
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    await this.noteRepository.remove(note);

    return {
      statusCode: 200,
      status: 'success',
      message: 'Note deleted successfully',
    };
  }
}

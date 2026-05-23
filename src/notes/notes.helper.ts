import { NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Tag } from '../tags/entities/tag.entity';
import { JwtUser, tagOwnerWhere } from '../tags/tags.helper';
import { Note } from './entities/note.entity';

export enum NotesFilterEnum {
  ALL = 'all',
  FAVOURITES = 'favourites',
  ARCHIVED = 'archived',
}

export type NoteFilters = {
  tagId?: string;
  filter?: NotesFilterEnum;
};

export const noteOwnerWhere = (userId: string): FindOptionsWhere<Note> => ({
  user: {
    id: userId,
  },
});

export const noteByIdWhere = (
  noteId: string,
  userId: string,
): FindOptionsWhere<Note> => ({
  id: noteId,
  ...noteOwnerWhere(userId),
});

export const buildCreateNotePayload = (
  title: string,
  content: string | null,
  tags: Tag[],
  user: JwtUser,
  isFavourite = false,
  isArchived = false,
) => ({
  title,
  content,
  user,
  tags,
  isFavourite,
  isArchived,
});

export const resolveOwnedTags = async (
  tagRepository: Repository<Tag>,
  tagIds?: string[],
  user?: JwtUser,
) => {
  if (!tagIds || tagIds.length === 0) {
    return [];
  }

  const uniqueTagIds = [...new Set(tagIds)];
  const tags = await tagRepository.find({
    where: uniqueTagIds.map((id) => ({
      id,
      ...(user ? tagOwnerWhere(user.id) : {}),
    })),
  });

  if (tags.length !== uniqueTagIds.length) {
    throw new NotFoundException('One or more tags were not found');
  }

  return tags;
};

export const noteCreatedResponse = (data: Note) => ({
  statusCode: 201,
  status: 'success',
  message: 'Note created successfully',
  data,
});

export const noteFetchedResponse = (message: string, data: Note | Note[]) => ({
  statusCode: 200,
  status: 'success',
  message,
  data,
});

export const noteDeletedResponse = (message: string) => ({
  statusCode: 200,
  status: 'success',
  message,
});

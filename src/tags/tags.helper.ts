import { FindOptionsWhere } from 'typeorm';
import { Tag } from './entities/tag.entity';

export type JwtUser = {
  id: string;
  email: string;
};

export const tagOwnerWhere = (userId: string): FindOptionsWhere<Tag> => ({
  user: {
    id: userId,
  },
});

export const ownedTagWhere = (
  tagId: string,
  userId: string,
): FindOptionsWhere<Tag> => ({
  id: tagId,
  ...tagOwnerWhere(userId),
});

export const tagNameWhere = (
  name: string,
  userId: string,
): FindOptionsWhere<Tag> => ({
  name,
  ...tagOwnerWhere(userId),
});

export const tagCreatePayload = (name: string, userId: string) => ({
  name,
  user: {
    id: userId,
  },
});


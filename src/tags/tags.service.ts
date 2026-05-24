import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tag } from './entities/tag.entity';
import {
  JwtUser,
  ownedTagWhere,
  tagCreatePayload,
  tagNameWhere,
} from './tags.helper';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  async create(createTagDto: CreateTagDto, user: JwtUser) {
    const existingTag = await this.tagRepository.findOne({
      where: tagNameWhere(createTagDto.name, user.id),
    });

    if (existingTag) {
      throw new ConflictException('Tag already exists');
    }

    const tag = this.tagRepository.create({
      ...tagCreatePayload(createTagDto.name, user.id),
    });

    const savedTag = await this.tagRepository.save(tag);

    return {
      statusCode: 201,
      status: 'success',
      message: 'Tag created successfully',
      data: savedTag,
    };
  }

  async findAll(user: JwtUser, scope?: string) {
    if (scope !== 'active-notes') {
      const tags = await this.tagRepository.find({
        where: {
          user: {
            id: user.id,
          },
        },
        order: {
          createdAt: 'DESC',
        },
      });

      return {
        statusCode: 200,
        status: 'success',
        message: 'Tags fetched successfully',
        data: tags,
      };
    }

    const tags = await this.tagRepository
      .createQueryBuilder('tag')
      .innerJoin('tag.notes', 'note')
      .where('tag.userId = :userId', { userId: user.id })
      .andWhere('note.userId = :userId', { userId: user.id })
      .andWhere('note.isArchived = :isArchived', { isArchived: false })
      .orderBy('tag.createdAt', 'DESC')
      .distinct(true)
      .getMany();

    return {
      statusCode: 200,
      status: 'success',
      message: 'Tags fetched successfully',
      data: tags,
    };
  }

  async findOne(id: string, user: JwtUser) {
    const tag = await this.tagRepository.findOne({
      where: ownedTagWhere(id, user.id),
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return {
      statusCode: 200,
      status: 'success',
      message: 'Tag fetched successfully',
      data: tag,
    };
  }

  async update(id: string, updateTagDto: UpdateTagDto, user: JwtUser) {
    const tag = await this.tagRepository.findOne({
      where: ownedTagWhere(id, user.id),
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    if (updateTagDto.name && updateTagDto.name !== tag.name) {
      const existingTag = await this.tagRepository.findOne({
        where: tagNameWhere(updateTagDto.name, user.id),
      });

      if (existingTag) {
        throw new ConflictException('Tag already exists');
      }

      tag.name = updateTagDto.name;
    }

    const updatedTag = await this.tagRepository.save(tag);

    return {
      statusCode: 200,
      status: 'success',
      message: 'Tag updated successfully',
      data: updatedTag,
    };
  }

  async remove(id: string, user: JwtUser) {
    const tag = await this.tagRepository.findOne({
      where: ownedTagWhere(id, user.id),
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.tagRepository.remove(tag);

    return {
      statusCode: 200,
      status: 'success',
      message: 'Tag deleted successfully',
    };
  }
}

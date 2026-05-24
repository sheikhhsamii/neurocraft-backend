import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotesFilterEnum } from './notes.helper';

@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  private parseFilter(value?: string) {
    if (value === NotesFilterEnum.FAVOURITES) {
      return NotesFilterEnum.FAVOURITES;
    }

    if (value === NotesFilterEnum.ARCHIVED) {
      return NotesFilterEnum.ARCHIVED;
    }

    return NotesFilterEnum.ALL;
  }

  @Post()
  create(@Body() createNoteDto: CreateNoteDto, @CurrentUser() user: { id: string; email: string }) {
    return this.notesService.create(createNoteDto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: { id: string; email: string },
    @Query('tagId') tagId?: string,
    @Query('filter') filter?: string,
    @Query('search') search?: string,
  ) {
    return this.notesService.findAll(user, {
      tagId,
      filter: this.parseFilter(filter),
      search,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string; email: string }) {
    return this.notesService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateNoteDto: UpdateNoteDto,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.notesService.update(id, updateNoteDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string; email: string }) {
    return this.notesService.remove(id, user);
  }
}

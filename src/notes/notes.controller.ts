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

@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  private parseBoolean(value?: string) {
    if (value === undefined) {
      return undefined;
    }

    if (value === 'true' || value === '1') {
      return true;
    }

    if (value === 'false' || value === '0') {
      return false;
    }

    return undefined;
  }

  @Post()
  create(@Body() createNoteDto: CreateNoteDto, @CurrentUser() user: { id: string; email: string }) {
    return this.notesService.create(createNoteDto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: { id: string; email: string },
    @Query('tagId') tagId?: string,
    @Query('archived') archived?: string,
    @Query('favourite') favourite?: string,
  ) {
    return this.notesService.findAll(user, {
      tagId,
      archived: this.parseBoolean(archived),
      favourite: this.parseBoolean(favourite),
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

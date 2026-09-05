import { Injectable } from '@nestjs/common';
import { listProjects } from './projects.js';

@Injectable()
export class PrismaService {
  listProjects() {
    return listProjects();
  }
}

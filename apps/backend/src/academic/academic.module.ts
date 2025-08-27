import { Module } from '@nestjs/common';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { ClassesModule } from './classes/classes.module';

@Module({
  imports: [
    AcademicYearsModule,
    ClassesModule,
  ],
  exports: [
    AcademicYearsModule,
    ClassesModule,
  ],
})
export class AcademicModule {}

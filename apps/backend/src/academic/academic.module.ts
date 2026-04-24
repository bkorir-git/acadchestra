/**
 * @module AcademicModule
 * @description Aggregate module wiring every sub-module of the academic domain.
 */

import { Module } from '@nestjs/common';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { AcademicTermsModule } from './academic-terms/academic-terms.module';
import { AcademicPeriodsModule } from './academic-periods/academic-periods.module';
import { ClassesModule } from './classes/classes.module';
import { SubjectsModule } from './subjects/subjects.module';
import { StudentClassHistoryModule } from './student-class-history/student-class-history.module';
import { PromotionsModule } from './promotions/promotions.module';
import { StudentsModule } from './students/students.module';
import { ProgressModule } from '../common/progress/progress.module';
import { AcademicDashboardModule } from './academic-dashboard/academic-dashboard.module';

@Module({
  imports: [
    AcademicYearsModule,
    AcademicTermsModule,
    AcademicPeriodsModule,
    ClassesModule,
    SubjectsModule,
    StudentClassHistoryModule,
    PromotionsModule,
    StudentsModule,
    ProgressModule,
    AcademicDashboardModule,
  ],
  exports: [
    AcademicYearsModule,
    AcademicTermsModule,
    AcademicPeriodsModule,
    ClassesModule,
    SubjectsModule,
    StudentClassHistoryModule,
    PromotionsModule,
    StudentsModule,
    ProgressModule,
    AcademicDashboardModule,
  ],
})
export class AcademicModule {}

import { IsDateString, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class UpdateRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  expectedDocs?: number;

  @IsOptional()
  @IsDateString({}, { message: "expiresAt doit être une date ISO (ex. 2026-04-19T00:00:00.000Z)" })
  expiresAt?: string;
}

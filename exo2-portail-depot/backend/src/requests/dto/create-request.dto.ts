import { IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'Le PIN doit contenir exactement 4 chiffres' })
  pin!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  expectedDocs?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}

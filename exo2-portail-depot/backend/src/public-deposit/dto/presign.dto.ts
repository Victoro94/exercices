import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class PresignDto {
  @IsString()
  @MaxLength(180)
  filename!: string;

  @IsString()
  mime!: string;

  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  size!: number;
}

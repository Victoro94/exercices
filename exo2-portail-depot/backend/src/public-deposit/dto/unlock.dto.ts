import { IsString, Matches } from 'class-validator';

export class UnlockDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN invalide' })
  pin!: string;
}

import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ValidateActivityDto {
  @IsString()
  tenantId: string;

  @IsString()
  memberId: string;

  @IsString()
  productId: string;

  @IsString()
  skuId: string;

  @IsOptional()
  @IsString()
  activityContextKey?: string | null;

  @IsOptional()
  @IsString()
  scene?: string;

  @IsOptional()
  @IsBoolean()
  isNewcomer?: boolean;

  @IsOptional()
  @IsString()
  memberLevel?: string;

  @IsOptional()
  @IsString()
  traceId?: string;
}

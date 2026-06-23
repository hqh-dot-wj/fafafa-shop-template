import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CourseGroupBuyRulesDto } from './course-group-buy.dto';

describe('CourseGroupBuyRulesDto', () => {
  it('should accept virtual fill strategy fields', () => {
    const dto = plainToInstance(CourseGroupBuyRulesDto, {
      price: 99,
      minCount: 2,
      maxCount: 5,
      totalLessons: 8,
      enableVirtualFill: true,
      virtualFillWindowMinutes: 30,
      allowLeaderManualFill: true,
      allowAdminManualFill: true,
      continueRecruitAfterFormed: true,
      postFormedRecruitMode: 'REAL_ONLY',
      leaderCanInspectVirtualMembers: true,
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject invalid post formed recruit mode', () => {
    const dto = plainToInstance(CourseGroupBuyRulesDto, {
      price: 99,
      minCount: 2,
      totalLessons: 8,
      postFormedRecruitMode: 'INVALID_MODE',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints).toMatchObject({
      isIn: '成团后招募模式不正确',
    });
  });
});

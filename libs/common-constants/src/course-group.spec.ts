import {
  COURSE_GROUP_FAILURE_STATUS_FILTER_OPTIONS,
  COURSE_GROUP_TEAM_STATUS_OPTIONS,
  getCourseGroupTeamStatusMeta,
} from './course-group';

describe('getCourseGroupTeamStatusMeta', () => {
  it('应返回已知状态的中文标签与语义色彩', () => {
    expect(getCourseGroupTeamStatusMeta('RECRUITING')).toMatchObject({
      label: '招募中',
      tagType: 'warning',
      tone: 'active',
    });
    expect(getCourseGroupTeamStatusMeta('IN_CLASS')).toMatchObject({
      label: '进行中',
      tagType: 'info',
      tone: 'running',
    });
    expect(getCourseGroupTeamStatusMeta('FAILED')).toMatchObject({
      label: '失败',
      tagType: 'error',
      tone: 'muted',
    });
  });

  it('应对未知状态保留原值并回退默认样式', () => {
    expect(getCourseGroupTeamStatusMeta('UNDERWAY')).toMatchObject({
      label: 'UNDERWAY',
      tagType: 'default',
      tone: 'muted',
    });
    expect(getCourseGroupTeamStatusMeta('')).toMatchObject({
      label: '-',
      tagType: 'default',
      tone: 'muted',
    });
  });
});

describe('COURSE_GROUP_TEAM_STATUS_OPTIONS', () => {
  it('应提供团队状态筛选选项且顺序稳定', () => {
    expect(COURSE_GROUP_TEAM_STATUS_OPTIONS).toEqual([
      { label: '招募中', value: 'RECRUITING' },
      { label: '已成团', value: 'FORMED' },
      { label: '进行中', value: 'IN_CLASS' },
      { label: '已结课', value: 'FINISHED' },
      { label: '失败', value: 'FAILED' },
      { label: '已关闭', value: 'CLOSED' },
    ]);
  });
});

describe('COURSE_GROUP_FAILURE_STATUS_FILTER_OPTIONS', () => {
  it('应提供失败处理页的筛选选项', () => {
    expect(COURSE_GROUP_FAILURE_STATUS_FILTER_OPTIONS).toEqual([
      { label: '失败', value: 'FAILED' },
      { label: '已关闭', value: 'CLOSED' },
      { label: '全部', value: '' },
    ]);
  });
});

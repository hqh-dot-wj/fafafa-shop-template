export const COURSE_GROUP_TEAM_STATUSES = [
  'RECRUITING',
  'FORMED',
  'IN_CLASS',
  'FINISHED',
  'FAILED',
  'CLOSED',
] as const;

export type CourseGroupTeamStatus = (typeof COURSE_GROUP_TEAM_STATUSES)[number];

export type CourseGroupStatusTagType = 'default' | 'error' | 'info' | 'success' | 'warning';

export type CourseGroupStatusTone = 'active' | 'muted' | 'running' | 'success';

export interface CourseGroupTeamStatusMeta {
  value: string;
  label: string;
  tagType: CourseGroupStatusTagType;
  tone: CourseGroupStatusTone;
}

const COURSE_GROUP_TEAM_STATUS_META_MAP: Record<CourseGroupTeamStatus, Omit<CourseGroupTeamStatusMeta, 'value'>> = {
  RECRUITING: {
    label: '招募中',
    tagType: 'warning',
    tone: 'active',
  },
  FORMED: {
    label: '已成团',
    tagType: 'success',
    tone: 'active',
  },
  IN_CLASS: {
    label: '进行中',
    tagType: 'info',
    tone: 'running',
  },
  FINISHED: {
    label: '已结课',
    tagType: 'default',
    tone: 'success',
  },
  FAILED: {
    label: '失败',
    tagType: 'error',
    tone: 'muted',
  },
  CLOSED: {
    label: '已关闭',
    tagType: 'default',
    tone: 'muted',
  },
};

export const COURSE_GROUP_TEAM_STATUS_OPTIONS = COURSE_GROUP_TEAM_STATUSES.map((status) => ({
  label: COURSE_GROUP_TEAM_STATUS_META_MAP[status].label,
  value: status,
}));

export const COURSE_GROUP_FAILURE_STATUS_FILTER_OPTIONS = [
  {
    label: COURSE_GROUP_TEAM_STATUS_META_MAP.FAILED.label,
    value: 'FAILED',
  },
  {
    label: COURSE_GROUP_TEAM_STATUS_META_MAP.CLOSED.label,
    value: 'CLOSED',
  },
  {
    label: '全部',
    value: '',
  },
] as const;

export function getCourseGroupTeamStatusMeta(status?: string | null): CourseGroupTeamStatusMeta {
  if (status && status in COURSE_GROUP_TEAM_STATUS_META_MAP) {
    const meta = COURSE_GROUP_TEAM_STATUS_META_MAP[status as CourseGroupTeamStatus];
    return {
      value: status,
      label: meta.label,
      tagType: meta.tagType,
      tone: meta.tone,
    };
  }

  const fallback = status?.trim();
  return {
    value: fallback || '',
    label: fallback || '-',
    tagType: 'default',
    tone: 'muted',
  };
}

export type NodeStatus = 'idle' | 'in_progress' | 'completed' | 'error';

export type SchemaFieldWidget =
  | 'ProductPicker'
  | 'StorePicker'
  | 'TimeRangePicker'
  | 'TimeBoxPicker'
  | 'ScheduleEditor'
  | 'MemberFilterEditor'
  | 'CouponPicker'
  | 'ActivityPoolPicker'
  | 'datetime'
  | 'date';

export type JsonSchemaFieldType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export interface JsonSchemaProperty {
  type?: JsonSchemaFieldType | JsonSchemaFieldType[];
  title?: string;
  description?: string;
  enum?: Array<string | number | boolean>;
  enumNames?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  'ui:widget'?: SchemaFieldWidget;
  'ui:placeholder'?: string;
  'ui:options'?: Record<string, unknown>;
}

export interface JsonSchemaObject extends JsonSchemaProperty {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface NodeValidationState {
  completed?: boolean;
  errors?: string[];
}

export interface NodeSchemaRef {
  source: 'static' | 'campaign-policy' | 'play-rule' | 'scene-template' | 'coupon-dto';
  schemaId?: string;
  contextRef?: string;
}

export interface OrchestrationNode {
  id: string;
  label: string;
  branchGroup?: string;
  schema?: NodeSchemaRef;
  required: boolean;
  hint?: string;
}

export interface OrchestrationEdge {
  from: string;
  to: string;
  highlightOnComplete: boolean;
}

export interface OrchestrationBranchRule {
  decidedBy: string;
  field: string;
  routes: Record<string, string>;
}

export interface OrchestrationWorkflow {
  code: string;
  name: string;
  entryNode: string;
  exitNode: string;
  nodes: OrchestrationNode[];
  edges: OrchestrationEdge[];
  branchRules: OrchestrationBranchRule[];
}

export interface NodeStatusContext {
  workflow: OrchestrationWorkflow;
  formData: Record<string, Record<string, unknown> | undefined>;
  validations: Record<string, NodeValidationState | undefined>;
}

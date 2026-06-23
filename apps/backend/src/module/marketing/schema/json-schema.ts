export type JsonSchemaFieldType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export interface MarketingJsonSchemaProperty {
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
  items?: MarketingJsonSchemaProperty;
  properties?: Record<string, MarketingJsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  'ui:widget'?: string;
  'ui:placeholder'?: string;
  'ui:options'?: Record<string, unknown>;
}

export interface MarketingJsonSchema extends MarketingJsonSchemaProperty {
  type: 'object';
  properties: Record<string, MarketingJsonSchemaProperty>;
  required?: string[];
}

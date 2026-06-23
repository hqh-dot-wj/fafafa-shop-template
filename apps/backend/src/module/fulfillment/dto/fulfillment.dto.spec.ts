import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AssignServiceFulfillmentDto,
  ReceiveProductFulfillmentDto,
  ShipProductFulfillmentDto,
  VerifyServiceFulfillmentDto,
} from './fulfillment.dto';

function flattenMessages(error: { constraints?: Record<string, string>; children?: unknown[] }): string[] {
  const children = (error.children ?? []) as Array<{ constraints?: Record<string, string>; children?: unknown[] }>;
  return [...Object.values(error.constraints ?? {}), ...children.flatMap((child) => flattenMessages(child))];
}

async function validationMessages<T extends object>(
  dtoClass: new () => T,
  input: Record<string, unknown>,
): Promise<string[]> {
  const instance = plainToInstance(dtoClass, input, {
    enableImplicitConversion: true,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: false,
  });

  return errors.flatMap((error) => flattenMessages(error));
}

describe('fulfillment DTO validation', () => {
  it.each([
    ['ship product', ShipProductFulfillmentDto, { orderId: 'order-1', operationId: 'op-1' }],
    ['receive product', ReceiveProductFulfillmentDto, { orderId: 'order-1', operationId: 'op-1' }],
    ['assign service', AssignServiceFulfillmentDto, { orderId: 'order-1', workerId: 1, operationId: 'op-1' }],
    ['verify service', VerifyServiceFulfillmentDto, { orderId: 'order-1', operationId: 'op-1' }],
  ])('%s accepts a valid payload', async (_label, dtoClass, payload) => {
    await expect(validationMessages(dtoClass, payload)).resolves.toEqual([]);
  });

  it.each([
    ['ship empty orderId', ShipProductFulfillmentDto, { orderId: '' }],
    ['ship empty operationId', ShipProductFulfillmentDto, { orderId: 'order-1', operationId: '' }],
    ['ship invalid item id', ShipProductFulfillmentDto, { orderId: 'order-1', items: [{ orderItemId: 0 }] }],
    ['ship invalid quantity', ShipProductFulfillmentDto, { orderId: 'order-1', items: [{ quantity: 0 }] }],
    ['receive empty orderId', ReceiveProductFulfillmentDto, { orderId: '' }],
    ['assign invalid workerId', AssignServiceFulfillmentDto, { orderId: 'order-1', workerId: 0 }],
    ['verify extra field', VerifyServiceFulfillmentDto, { orderId: 'order-1', permissions: ['*:*:*'] }],
  ])('%s is rejected', async (_label, dtoClass, payload) => {
    await expect(validationMessages(dtoClass, payload)).resolves.not.toEqual([]);
  });
});

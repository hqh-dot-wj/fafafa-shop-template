import { SetMetadata } from '@nestjs/common';
import { CodeManagedJobMetadata, CodeManagedJobRegistryEntry } from '../interfaces/code-managed-job.interface';

export const CODE_MANAGED_JOB_METADATA = 'code-managed-job:metadata';

export class CodeManagedJobRegistry {
  private static instance: CodeManagedJobRegistry;
  private readonly entries = new Map<string, CodeManagedJobRegistryEntry>();

  private constructor() {}

  static getInstance() {
    if (!CodeManagedJobRegistry.instance) {
      CodeManagedJobRegistry.instance = new CodeManagedJobRegistry();
    }
    return CodeManagedJobRegistry.instance;
  }

  register(target: any, methodName: string, metadata: CodeManagedJobMetadata) {
    const classOrigin = target.constructor;
    const registryKey = `${classOrigin.name}:${methodName}`;
    this.entries.set(registryKey, { classOrigin, methodName, metadata });
  }

  get(target: any, methodName: string) {
    return this.entries.get(`${target.name}:${methodName}`);
  }

  getAll() {
    return Array.from(this.entries.values());
  }
}

export const CodeManagedJob = (metadata: CodeManagedJobMetadata): MethodDecorator => {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    SetMetadata(CODE_MANAGED_JOB_METADATA, metadata)(target, propertyKey, descriptor);
    CodeManagedJobRegistry.getInstance().register(target, propertyKey.toString(), metadata);
    return descriptor;
  };
};

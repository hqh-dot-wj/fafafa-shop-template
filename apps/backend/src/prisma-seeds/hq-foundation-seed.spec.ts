import { PrismaClient } from '@prisma/client';

import { seedAttrTemplates } from '../../prisma/seeds/01-hq-foundation/attr-templates';
import { seedBrands } from '../../prisma/seeds/01-hq-foundation/brands';
import { seedCategories } from '../../prisma/seeds/01-hq-foundation/categories';
import { seedHqFoundation } from '../../prisma/seeds/01-hq-foundation';
import { seedPlayDefinitions } from '../../prisma/seeds/01-hq-foundation/play-definitions';
import { seedPlayTemplates } from '../../prisma/seeds/01-hq-foundation/play-templates';
import { seedHunanInstantProducts } from '../../prisma/seeds/01-hq-foundation/products-hunan-instant';
import { seedHunanRetailProducts } from '../../prisma/seeds/01-hq-foundation/products-hunan-retail';
import { seedHunanServiceProducts } from '../../prisma/seeds/01-hq-foundation/products-hunan-service';
import { seedProducts } from '../../prisma/seeds/01-hq-foundation/products';

jest.mock('../../prisma/seeds/01-hq-foundation/categories', () => ({ seedCategories: jest.fn() }));
jest.mock('../../prisma/seeds/01-hq-foundation/brands', () => ({ seedBrands: jest.fn() }));
jest.mock('../../prisma/seeds/01-hq-foundation/attr-templates', () => ({ seedAttrTemplates: jest.fn() }));
jest.mock('../../prisma/seeds/01-hq-foundation/products', () => ({ seedProducts: jest.fn() }));
jest.mock('../../prisma/seeds/01-hq-foundation/play-definitions', () => ({ seedPlayDefinitions: jest.fn() }));
jest.mock('../../prisma/seeds/01-hq-foundation/play-templates', () => ({ seedPlayTemplates: jest.fn() }));
jest.mock('../../prisma/seeds/01-hq-foundation/products-hunan-retail', () => ({
  seedHunanRetailProducts: jest.fn(),
}));
jest.mock('../../prisma/seeds/01-hq-foundation/products-hunan-instant', () => ({
  seedHunanInstantProducts: jest.fn(),
}));
jest.mock('../../prisma/seeds/01-hq-foundation/products-hunan-service', () => ({
  seedHunanServiceProducts: jest.fn(),
}));

describe('seedHqFoundation', () => {
  const prisma = {} as PrismaClient;
  const seedSteps = [
    seedCategories,
    seedBrands,
    seedAttrTemplates,
    seedProducts,
    seedPlayDefinitions,
    seedPlayTemplates,
    seedHunanRetailProducts,
    seedHunanInstantProducts,
    seedHunanServiceProducts,
  ] as Array<jest.MockedFunction<(client: PrismaClient) => Promise<void>>>;

  beforeEach(() => {
    for (const step of seedSteps) {
      step.mockResolvedValue(undefined);
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('runs all HQ foundation seed steps including play_definition runtime definitions', async () => {
    await seedHqFoundation(prisma);

    for (const step of seedSteps) {
      expect(step).toHaveBeenCalledTimes(1);
      expect(step).toHaveBeenCalledWith(prisma);
    }
  });
});

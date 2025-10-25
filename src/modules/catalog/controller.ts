import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../errors';
import { CatalogService } from './service';
import {
  catalogSellerIdParamSchema,
  listCatalogSamplesQuerySchema,
  listCatalogSellersQuerySchema,
  listSellerSamplesQuerySchema,
  saveCatalogSampleBodySchema,
} from './schemas';
import { sampleIdParamSchema } from '../samples/schemas';

const service = new CatalogService();

const ensurePriceRangeValid = (priceMin?: number, priceMax?: number) => {
  if (typeof priceMin === 'number' && typeof priceMax === 'number' && priceMin > priceMax) {
    throw new HttpError(400, 'priceMin must be less than or equal to priceMax');
  }
};

export const listCatalogSellers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listCatalogSellersQuerySchema.parse(req.query);
    const result = await service.listSellers(query);

    res.json({
      data: result.items,
      meta: {
        total: result.total,
        skip: query.skip,
        take: query.take,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCatalogSeller = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = catalogSellerIdParamSchema.parse(req.params);
    const seller = await service.getSellerById(params.sellerId);
    res.json({ data: seller });
  } catch (error) {
    next(error);
  }
};

export const listCatalogSellerSamples = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const params = catalogSellerIdParamSchema.parse(req.params);
    const query = listSellerSamplesQuerySchema.parse(req.query);

    ensurePriceRangeValid(query.priceMin, query.priceMax);

    const result = await service.listSellerSamples(params.sellerId, query);
    res.json({
      data: result.items,
      meta: {
        total: result.total,
        skip: query.skip,
        take: query.take,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listCatalogSamples = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listCatalogSamplesQuerySchema.parse(req.query);
    ensurePriceRangeValid(query.priceMin, query.priceMax);

    const result = await service.listSamples(query);
    res.json({
      data: result.items,
      meta: {
        total: result.total,
        skip: query.skip,
        take: query.take,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const saveCatalogSample = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    const params = sampleIdParamSchema.parse(req.params);
    const body = saveCatalogSampleBodySchema.parse(req.body);

    const saved = await service.saveSampleToCollection(params.id, body.collectionId, authUser.id);
    res.status(201).json({ data: saved });
  } catch (error) {
    next(error);
  }
};

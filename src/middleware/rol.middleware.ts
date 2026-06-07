import { Request, Response, NextFunction } from 'express';

export const esAbogado = (req: Request, res: Response, next: NextFunction): void => {
  const rol = (req as any).rol;
  if (rol !== 'abogado' && rol !== 'admin') {
    res.status(403).json({ error: 'Acceso restringido a abogados' });
    return;
  }
  next();
};

export const esAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const rol = (req as any).rol;
  if (rol !== 'admin') {
    res.status(403).json({ error: 'Acceso restringido a administradores' });
    return;
  }
  next();
};

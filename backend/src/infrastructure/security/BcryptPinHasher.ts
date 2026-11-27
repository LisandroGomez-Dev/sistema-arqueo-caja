import bcrypt from 'bcryptjs';
import type { PinHasherPort } from '../../application/ports/out/PinHasherPort.js';

export class BcryptPinHasher implements PinHasherPort {
  async verificar(pinPlano: string, hash: string): Promise<boolean> {
    return bcrypt.compare(pinPlano, hash);
  }
}

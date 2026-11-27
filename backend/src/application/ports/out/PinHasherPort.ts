export interface PinHasherPort {
  verificar(pinPlano: string, hash: string): Promise<boolean>;
}

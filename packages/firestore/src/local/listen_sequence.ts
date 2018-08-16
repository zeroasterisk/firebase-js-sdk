import { ListenSequenceNumber } from '../core/types';

export class ListenSequence {
  static readonly INVALID: ListenSequenceNumber = -1;

  private previousSequenceNumber: number;
  constructor(startAfter: number) {
    this.previousSequenceNumber = startAfter;
  }

  next(): ListenSequenceNumber {
    return ++this.previousSequenceNumber;
  }
}

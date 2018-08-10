import { ListenSequenceNumber } from './types';
import { assert } from '../util/assert';
import { AsyncQueue } from '../util/async_queue';
import * as log from '../util/log';

const LOG_TAG = 'ListenSequence';
const SEQUENCE_NUMBER_KEY = 'firebase_sequence_number';

function parseSequenceNumber(seqString: string | null): ListenSequenceNumber {
  let sequenceNumber = ListenSequence.INVALID;
  if (seqString != null) {
    try {
      const parsed = JSON.parse(seqString) as ListenSequenceNumber;
      assert(typeof parsed === 'number', 'Found non-numeric sequence number');
      sequenceNumber = parsed;
    } catch (e) {
      log.error(LOG_TAG, 'Failed to read sequence number from local storage', e);
    }
  }
  return sequenceNumber;
}

export class ListenSequence {
  static readonly INVALID: ListenSequenceNumber = -1;

  private webStorage?: Storage;

  constructor(private previousValue: ListenSequenceNumber, storageParams?: {storage: Storage, queue: AsyncQueue, window: Window}) {
    if (storageParams) {
      this.webStorage = storageParams.storage;
      
      storageParams.window.addEventListener('storage', (e: StorageEvent) => {
        if (e.storageArea === this.webStorage && e.key === SEQUENCE_NUMBER_KEY) {
          const sequenceNumber = parseSequenceNumber(e.newValue);
          if (sequenceNumber !== ListenSequence.INVALID) {
            // Set the value on the queue so that we don't change it in the middle
            // of an operation.
            storageParams.queue.enqueueAndForget(() => {
              this.setPreviousValue(sequenceNumber);
              return Promise.resolve();
            });
          }
        }
      });
      const sequenceNumber = parseSequenceNumber(this.webStorage.getItem(SEQUENCE_NUMBER_KEY));
      if (sequenceNumber !== ListenSequence.INVALID) {
        // We're already on the async queue, so we can directly set the previous value
        this.setPreviousValue(sequenceNumber);
      }
    }
  }

  private setPreviousValue(externalPreviousValue: ListenSequenceNumber): ListenSequenceNumber {
    this.previousValue = Math.max(externalPreviousValue, this.previousValue);
    return this.previousValue;
  }

  next(): ListenSequenceNumber {
    const nextValue = ++this.previousValue;
    if (this.webStorage) {
      this.webStorage.setItem(SEQUENCE_NUMBER_KEY, JSON.stringify(nextValue));
    }
    return nextValue;
  }
}
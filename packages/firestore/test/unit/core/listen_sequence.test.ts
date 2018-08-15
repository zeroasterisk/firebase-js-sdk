import { fail } from "assert";
import { ListenSequence } from '../../../src/core/listen_sequence';
import { AsyncQueue } from '../../../src/util/async_queue';

describe('ListenSequence', () => {

  it('writes the new sequence number to local storage', () => {
    const listenSequence = new ListenSequence(0);
    fail('not yet implemented');
  });

  it('bumps the next value based on local storage writes', () => {
    fail('not yet implemented');
  });
});
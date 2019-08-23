/**
 * @license
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Query } from '../../../src/core/query';
import { deletedDoc, doc, key, path } from '../../util/helpers';

import { TimerId } from '../../../src/util/async_queue';
import { describeSpec, specTest } from './describe_spec';
import { client, spec } from './spec_builder';

describeSpec('Simulated:', ['exclusive'], () => {
  specTest('(Memory) Events are raised after watch ack', [], () => {
    const query1 = Query.atPath(path('collection'));
    const doc1 = doc('collection/key', 1000, { foo: 'bar' });
    return spec()
      .userListens(query1)
      .expectWatchStreamRequestCount(1)
      .expectActiveTargets({ query: query1, resumeToken: '' })
      .watchAcks(query1)
      .watchSends({ affects: [query1] }, doc1)
      .watchCurrents(query1, 'resume-token-1001')
      .watchSnapshots(1001)
      .expectEvents(query1, { added: [doc1] });
  });

  specTest(
    '(Memory) Events are raised for local sets before watch ack',
    ['exclusive'],
    () => {
      const query1 = Query.atPath(path('collection'));
      const doc1 = doc(
        'collection/key',
        0,
        { foo: 'bar' },
        { hasLocalMutations: true }
      );
      return spec()
        .userListens(query1)
        .expectWatchStreamRequestCount(1)
        .expectActiveTargets({ query: query1, resumeToken: '' })
        .userSets('collection/key', { foo: 'bar' })
        .expectNumOutstandingWrites(1)
        .expectWriteStreamRequestCount(2)
        .expectEvents(query1, {
          added: [doc1],
          fromCache: true,
          hasPendingWrites: true
        });
    }
  );

  specTest('(Memory) Existence filter match', ['exclusive'], () => {
    const query1 = Query.atPath(path('collection'));
    const doc1 = doc('collection/1', 1000, { v: 1 });
    return spec()
      .userListens(query1)
      .expectWatchStreamRequestCount(1)
      .expectActiveTargets({ query: query1, resumeToken: '' })
      .watchAcks(query1)
      .watchSends({ affects: [query1] }, doc1)
      .watchCurrents(query1, 'resume-token-1000')
      .watchSnapshots(1000)
      .expectEvents(query1, { added: [doc1] })
      .watchFilters([query1], key('collection/1'))
      .watchSnapshots(2000);
  });

  specTest(
    '(Memory) Existence filter match after pending update',
    ['exclusive'],
    () => {
      const query1 = Query.atPath(path('collection'));
      const doc1 = doc('collection/1', 2000, { v: 2 });
      return spec()
        .userListens(query1)
        .expectWatchStreamRequestCount(1)
        .expectActiveTargets({ query: query1, resumeToken: '' })
        .watchAcks(query1)
        .watchCurrents(query1, 'resume-token-1000')
        .watchSnapshots(2000)
        .expectEvents(query1, {})
        .watchSends({ affects: [query1] }, doc1)
        .watchFilters([query1], key('collection/1'))
        .watchSnapshots(2000)
        .expectEvents(query1, { added: [doc1] });
    }
  );

  specTest('(Memory) Existence filter with empty target', ['exclusive'], () => {
    const query1 = Query.atPath(path('collection'));
    return spec()
      .userListens(query1)
      .expectWatchStreamRequestCount(1)
      .expectActiveTargets({ query: query1, resumeToken: '' })
      .watchAcks(query1)
      .watchCurrents(query1, 'resume-token-1000')
      .watchSnapshots(2000)
      .expectEvents(query1, {})
      .watchFilters([query1], key('collection/1'))
      .watchSnapshots(2000)
      .expectWatchStreamRequestCount(3)
      .expectEvents(query1, { fromCache: true });
  });

  specTest(
    '(Memory) Existence filter ignored with pending target',
    ['exclusive'],
    () => {
      const query1 = Query.atPath(path('collection'));
      const doc1 = doc('collection/1', 2000, { v: 2 });
      return spec()
        .withGCEnabled(false)
        .userListens(query1)
        .expectWatchStreamRequestCount(1)
        .expectActiveTargets({ query: query1, resumeToken: '' })
        .watchAcks(query1)
        .watchSends({ affects: [query1] }, doc1)
        .watchCurrents(query1, 'resume-token-1000')
        .watchSnapshots(1000)
        .expectEvents(query1, { added: [doc1] })
        .userUnlistens(query1)
        .expectWatchStreamRequestCount(2)
        .expectActiveTargets()
        .userListens(query1)
        .expectWatchStreamRequestCount(3)
        .expectActiveTargets({
          query: query1,
          resumeToken: 'resume-token-1000'
        })
        .expectEvents(query1, { added: [doc1], fromCache: true })
        .watchFilters([query1])
        .watchRemoves(query1)
        .watchAcks(query1)
        .watchCurrents(query1, 'resume-token-2000')
        .watchSnapshots(2000)
        .expectEvents(query1, {});
    }
  );

  specTest(
    '(Memory) Existence filter mismatch triggers re-run of query',
    ['exclusive'],
    () => {
      const query1 = Query.atPath(path('collection'));
      const doc1 = doc('collection/1', 1000, { v: 1 });
      const doc2 = doc('collection/2', 1000, { v: 2 });
      return spec()
        .userListens(query1)
        .expectWatchStreamRequestCount(1)
        .watchAcks(query1)
        .watchSends({ affects: [query1] }, doc1, doc2)
        .watchCurrents(query1, 'resume-token-1000')
        .watchSnapshots(1000)
        .expectEvents(query1, { added: [doc1, doc2] })
        .watchFilters([query1], key('collection/1'))
        .watchSnapshots(2000)
        .expectWatchStreamRequestCount(3)
        .expectEvents(query1, { fromCache: true })
        .watchRemoves(query1)
        .watchAcks(query1)
        .watchSends({ affects: [query1] }, doc1)
        .watchCurrents(query1, 'resume-token-2000')
        .watchSnapshots(2000)
        .expectLimboDocs(key('collection/2'))
        .expectWatchStreamRequestCount(4)
        .ackLimbo(2000, deletedDoc('collection/2', 2000))
        .expectLimboDocs()
        .expectWatchStreamRequestCount(5)
        .expectEvents(query1, { removed: [doc2] });
    }
  );

  specTest(
    '(Memory) Existence filter mismatch will drop resume token',
    ['exclusive'],
    () => {
      const query1 = Query.atPath(path('collection'));
      const doc1 = doc('collection/1', 1000, { v: 1 });
      const doc2 = doc('collection/2', 1000, { v: 2 });
      return spec()
        .userListens(query1)
        .expectWatchStreamRequestCount(1)
        .watchAcks(query1)
        .watchSends({ affects: [query1] }, doc1, doc2)
        .watchCurrents(query1, 'existence-filter-resume-token')
        .watchSnapshots(1000)
        .expectEvents(query1, { added: [doc1, doc2] })
        .watchStreamCloses('unavailable', { runBackoffTimer: true })
        .expectWatchStreamRequestCount(2)
        .watchAcks(query1)
        .watchFilters([query1], key('collection/1'))
        .watchSnapshots(2000)
        .expectWatchStreamRequestCount(4)
        .expectEvents(query1, { fromCache: true })
        .watchRemoves(query1)
        .watchAcks(query1)
        .watchSends({ affects: [query1] }, doc1)
        .watchCurrents(query1, 'resume-token-2000')
        .watchSnapshots(2000)
        .expectLimboDocs(key('collection/2'))
        .expectWatchStreamRequestCount(5)
        .ackLimbo(2000, deletedDoc('collection/2', 2000))
        .expectLimboDocs()
        .expectWatchStreamRequestCount(6)
        .expectEvents(query1, { removed: [doc2] });
    }
  );
});

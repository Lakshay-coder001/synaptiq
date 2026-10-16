(function() {
  const PENDING = 'PENDING';
  const FULFILLED = 'FULFILLED';
  const REJECTED = 'REJECTED';

  /**
   * Educational custom Promise implementation.
   * Demonstrates the inner workings of Promises, state machines, and microtasks.
   */
  class SynaptiqPromise {
    constructor(executor) {
      this.state = PENDING;
      this.value = undefined;
      this.reason = undefined;
      this.onFulfilledCallbacks = [];
      this.onRejectedCallbacks = [];

      const resolve = (value) => {
        if (this.state === PENDING) {
          this.state = FULFILLED;
          this.value = value;
          // Callbacks must execute asynchronously (microtask)
          queueMicrotask(() => {
            this.onFulfilledCallbacks.forEach(fn => fn(this.value));
          });
        }
      };

      const reject = (reason) => {
        if (this.state === PENDING) {
          this.state = REJECTED;
          this.reason = reason;
          // Callbacks must execute asynchronously (microtask)
          queueMicrotask(() => {
            this.onRejectedCallbacks.forEach(fn => fn(this.reason));
          });
        }
      };

      try {
        executor(resolve, reject);
      } catch (error) {
        reject(error);
      }
    }

    then(onFulfilled, onRejected) {
      onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value;
      onRejected = typeof onRejected === 'function' ? onRejected : reason => { throw reason; };

      const promise2 = new SynaptiqPromise((resolve, reject) => {
        const handleFulfilled = () => {
          try {
            const x = onFulfilled(this.value);
            this._resolvePromise(promise2, x, resolve, reject);
          } catch (error) {
            reject(error);
          }
        };

        const handleRejected = () => {
          try {
            const x = onRejected(this.reason);
            this._resolvePromise(promise2, x, resolve, reject);
          } catch (error) {
            reject(error);
          }
        };

        if (this.state === FULFILLED) {
          queueMicrotask(handleFulfilled);
        } else if (this.state === REJECTED) {
          queueMicrotask(handleRejected);
        } else if (this.state === PENDING) {
          this.onFulfilledCallbacks.push(() => {
            queueMicrotask(handleFulfilled);
          });
          this.onRejectedCallbacks.push(() => {
            queueMicrotask(handleRejected);
          });
        }
      });

      return promise2;
    }

    catch(onRejected) {
      return this.then(null, onRejected);
    }

    _resolvePromise(promise2, x, resolve, reject) {
      if (promise2 === x) {
        return reject(new TypeError('Chaining cycle detected for promise'));
      }

      if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
        let called = false;
        try {
          const then = x.then;
          if (typeof then === 'function') {
            then.call(
              x,
              y => {
                if (called) return;
                called = true;
                this._resolvePromise(promise2, y, resolve, reject);
              },
              r => {
                if (called) return;
                called = true;
                reject(r);
              }
            );
          } else {
            resolve(x);
          }
        } catch (error) {
          if (called) return;
          called = true;
          reject(error);
        }
      } else {
        resolve(x);
      }
    }

    static resolve(value) {
      return new SynaptiqPromise(resolve => resolve(value));
    }

    static reject(reason) {
      return new SynaptiqPromise((resolve, reject) => reject(reason));
    }
  }

  /**
   * Demonstrates the custom Promise and execution contexts.
   */
  function demoCustomPromise() {
    console.log('1. [Macrotask/Sync] Starting Custom Promise Demo');

    const p = new SynaptiqPromise((resolve, reject) => {
      console.log('2. [Macrotask/Sync] Inside Executor');
      resolve('Success Value');
    });

    p.then(value => {
      console.log(`4. [Microtask] then() callback executed with: ${value}`);
      return 'Chained Value';
    }).then(value => {
      console.log(`5. [Microtask] chained then() callback executed with: ${value}`);
      throw new Error('Test Error');
    }).catch(error => {
      console.log(`6. [Microtask] catch() callback executed with: ${error.message}`);
    });

    setTimeout(() => {
      console.log('7. [Macrotask] setTimeout executed');
    }, 0);

    console.log('3. [Macrotask/Sync] Ending Custom Promise Demo function block');
  }

  window.SynaptiqPromise = SynaptiqPromise;
  window.demoCustomPromise = demoCustomPromise;

})();

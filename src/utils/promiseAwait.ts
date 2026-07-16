const promiseAwait = <T>(promise: Promise<T>) => {
  return promise.then(v => [null, v] as const).catch(e => [e, null] as const);
};

export default promiseAwait;

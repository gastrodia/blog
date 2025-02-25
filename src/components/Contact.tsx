const Contact = () => {
  return (
    <form action="/api/email" method="post" className="space-y-3 py-3">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm">
          YOUR EMAIL
        </label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder="email"
          required
          className="block w-full rounded border border-skin-fill 
          border-opacity-40 bg-skin-fill p-3 placeholder:text-opacity-75 
          focus:border-skin-accent focus:outline-none"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="message" className="text-sm">
          MESSAGE
        </label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={10000}
          rows={10}
          className="block w-full rounded border border-skin-fill 
          border-opacity-40 bg-skin-fill p-3 placeholder:text-opacity-75 
          focus:border-skin-accent focus:outline-none"
        />
      </div>
      <input
        type="submit"
        className="border w-full border-skin-fill 
        border-opacity-40 bg-skin-fill hover:bg-gray-200 hover:dark:bg-gray-700 cursor-pointer rounded-md px-3 py-2 active:bg-gray-300 dark:bg-gray-800"
        value="SEND"
      />
    </form>
  );
};

export default Contact;

const Contact = () => {
  return (
    <form action="#" className="space-y-3 py-3">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm">
          EMAIL
        </label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder="email"
          required
          className="border w-full rounded-md bg-gray-100 px-3 py-2 dark:bg-gray-800"
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
          className="border w-full rounded-md bg-gray-100 px-3 py-2 dark:bg-gray-800"
        />
      </div>
      <input
        type="submit"
        className="border w-full hover:bg-gray-200 hover:dark:bg-gray-700 cursor-pointer rounded-md bg-gray-100 px-3 py-2 active:bg-gray-300 dark:bg-gray-800"
        value="SEND"
      />
    </form>
  );
};

export default Contact;

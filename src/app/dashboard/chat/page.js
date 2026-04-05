export default function ChatPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="bg-gray-800 p-4 border-b border-gray-700">
        <h1 className="text-xl font-semibold">Chat</h1>
      </header>
      <div className="flex-grow p-4 overflow-y-auto">
        {/* Chat messages will go here */}
        <div className="text-center text-gray-500">
          No messages yet. Start the conversation!
        </div>
      </div>
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center">
          <input
            type="text"
            placeholder="Type your message..."
            className="flex-grow bg-gray-700 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="ml-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}


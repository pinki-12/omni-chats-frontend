import { useState } from "react";
import axios from "axios";
import "./AIChat.css";

const AIChat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;

    const userMessage = {
      sender: "user",
      text: message,
    };

    setMessages((prev) => [...prev, userMessage]);

    const currentMessage = message;
    setMessage("");
    setLoading(true);

    try {
      const res = await axios.post(
        "https://omni-chats-backend.onrender.com/api/ai/ask",
        {
          message: currentMessage,
        }
      );

      const aiMessage = {
        sender: "ai",
        text: res.data.reply,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.log(error);

      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Something went wrong",
        },
      ]);
    }

    setLoading(false);
  };

  // return (
  //    <div className="ai-page">
  //   <div className="ai-chat">
  //     <h2>AI Assistant 🤖</h2>

  //     <div className="chat-box">
  //       {messages.map((msg, index) => (
  //         <div
  //           key={index}
  //           className={
  //             msg.sender === "user"
  //               ? "user-message"
  //               : "ai-message"
  //           }
  //         >
  //           {msg.text}
  //         </div>
  //       ))}

  //       {loading && (
  //         <div className="ai-message">
  //           Thinking...
  //         </div>
  //       )}
  //     </div>

  //     <div className="input-area">
  //       <input
  //         type="text"
  //         placeholder="Ask anything..."
  //         value={message}
  //         onChange={(e) =>
  //           setMessage(e.target.value)
  //         }
  //       />

  //       <button onClick={handleSend}>
  //         Send
  //       </button>
  //     </div>
  //   </div>
  //   </div>
  // );

return (
  <div className="ai-page-wrapper">
    <div className="ai-chat-container">

      {/* Header */}

      <div className="ai-header">
        <div className="ai-avatar">🤖</div>

        <div className="ai-details">
          <h2>AI Assistant</h2>
          <div className="ai-status">Online</div>
        </div>
      </div>

      {/* Messages */}

      <div className="ai-messages">
        {messages.length === 0 && (
          <div className="ai-message-wrapper">
            <div className="ai-message">
              Hello 👋, I am your AI Assistant. Ask me anything.
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={
              msg.sender === "user"
                ? "user-message-wrapper"
                : "ai-message-wrapper"
            }
          >
            <div
              className={
                msg.sender === "user"
                  ? "user-message"
                  : "ai-message"
              }
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-message-wrapper">
            <div className="ai-message ai-thinking">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input */}

      <div className="ai-input-bar">
        <input
          className="ai-input"
          type="text"
          placeholder="Ask AI anything..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
        />

        <button
          className="ai-send-btn"
          onClick={handleSend}
          disabled={loading}
        >
          ➤
        </button>
      </div>

    </div>
  </div>
);
};

export default AIChat;
# LLM Evaluation Platform

Web app combining **Next.js** for the frontend and **FastAPI** for the backend to create a powerful AI-powered content evaluation platform.

![LLM Evaluation Platform Dashboard](https://i.imgur.com/YHbwDaB.png)

---

## Features

- **AI-Powered Content Analysis**: Analyze text content with state-of-the-art language models
- **Sentiment Analysis**: Visualize the emotional tone of your content with interactive charts
- **Authentication**: Secure user authentication via Clerk
- **Real-time AI Suggestions**: Get content improvement suggestions from various LLMs
- **Responsive UI**: Seamless experience across desktop and mobile devices
- **Interactive Visualizations**: Multiple chart types including sunburst, pie, bar, and circle pack

---

## Getting Started

### Prerequisites

- Node.js 18.x or later
- Python 3.10 or later
- OpenAI API key
- Clerk account and credentials

### Environment Setup

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd llm-evaluation-platform
   ```

2. Create and configure environment variables:

   Create a `.env.local` file in the root directory and add your keys.

3. Install frontend dependencies:

   ```bash
   cd frontend
   npm install
   ```

4. Install backend dependencies:
   ```bash
   cd ../backend
   pip install -r requirements.txt
   ```

---

## Running the Development Servers

1. **Start the Next.js frontend:**

   ```bash
   cd frontend
   npm run dev
   ```

2. **In a separate terminal, start the FastAPI backend:**

   ```bash
   cd backend
   uvicorn main:app --reload
   ```

3. Open [http://localhost:3000](http://localhost:3000) to view the application in your browser.

---

## Application Structure

- **Frontend**: Next.js
- **Backend**: FastAPI

---

## Key Features Walkthrough

### Sign-in Page

The platform features a secure authentication system powered by Clerk, allowing users to sign in with email/password or social providers.

![Sign-in Page](https://raw.githubusercontent.com/iababio/llm_evaluator/2b7ddc1cfd643a70aaa7342ba5d23f18c52bc532/public/signin.png)

### Document Editor

The document editor provides a clean interface for writing and editing content, with real-time word count and AI assistance.

![Document Editor](https://i.imgur.com/1JfWgDm.png)

### Sentiment Analysis

Get comprehensive sentiment analysis of your content with interactive visualizations.

![Sentiment Analysis](https://raw.githubusercontent.com/iababio/llm_evaluator/2b7ddc1cfd643a70aaa7342ba5d23f18c52bc532/public/sentiment.png)

### Sunburst Chart

The sunburst chart provides a hierarchical view of sentiment distribution in your content.

![Sunburst Chart](https://raw.githubusercontent.com/iababio/llm_evaluator/2b7ddc1cfd643a70aaa7342ba5d23f18c52bc532/public/sunburst.png)

### Circle Chart

The Circle chart provides a hierarchical view of sentiment distribution in your content.

![Circle Chart](https://raw.githubusercontent.com/iababio/llm_evaluator/2b7ddc1cfd643a70aaa7342ba5d23f18c52bc532/public/circle.png)

### Pie Chart

Manage multiple documents in the left sidebar with search functionality.

![Pie Chart](https://raw.githubusercontent.com/iababio/llm_evaluator/2b7ddc1cfd643a70aaa7342ba5d23f18c52bc532/public/pie.png)

---

## API Endpoints

| Endpoint          | Method | Description                               |
| ----------------- | ------ | ----------------------------------------- |
| `/api/chat`       | POST   | Send messages to the LLM for conversation |
| `/api/completion` | POST   | Get completion suggestions for text       |
| `/api/sentiment`  | POST   | Analyze sentiment in provided text        |

---

## Contributing

Contributions are welcome! Please feel free to submit pull requests.

1. Fork the repository
2. Create your feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Commit your changes:
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. Push to the branch:
   ```bash
   git push origin feature/amazing-feature
   ```
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Acknowledgements

- Next.js
- FastAPI
- OpenAI
- Clerk
- D3.js
- Tailwind CSS
- Shadcn UI

> **Note**: The screenshots shown are from the demo version of the application. Your instance may vary depending on your content and configuration.

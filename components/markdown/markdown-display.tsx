import React, { FC, memo } from "react";
import dynamic from "next/dynamic";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { CodeBlock } from "@/components/markdown/code-block";
import remarkGfm from "remark-gfm";
import type { Options } from "react-markdown";

// Dynamically import ReactMarkdown to avoid CommonJS/ESM conflicts
const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
});

// Create a memoized version of ReactMarkdown
export const EnhancedReactMarkdown: FC<Options> = memo(
  (props) => <ReactMarkdown {...props} />,
  (prevProps: Readonly<Options>, nextProps: Readonly<Options>) =>
    prevProps.children === nextProps.children
);

interface MathComponentProps extends React.HTMLAttributes<HTMLDivElement> {
	value?: string;
	inline?: boolean;
}

const normalizeUrl = (url: string) => {
	// Remove any spaces in the URL
	const cleanUrl = url.replace(/\s+/g, "");

	// Return the cleaned URL
	return cleanUrl;
};

// Function to validate URLs
const isValidUrl = (url: string) => {
	try {
		// Extract URL from markdown format if present
		let testUrl = url;
		const markdownLinkRegex = /\[.*?\]\((.*?)\)/;
		const markdownMatch = url.match(markdownLinkRegex);
		if (markdownMatch) {
			testUrl = markdownMatch[1];
		}

		new URL(testUrl);
		return true;
	} catch {
		return false;
	}
};

// Function to clean and handle links specifically from responses
const processLinks = (text: string) => {
	const urlRegex = /\[(.*?)\]\((.*?)\)/g;
	return text.replace(urlRegex, (match, linkText, url) => {
		// Normalize URL to remove spaces
		const normalizedUrl = normalizeUrl(url);

		// Check if the URL is valid
		if (!isValidUrl(normalizedUrl)) {
			console.warn(`Invalid URL: ${normalizedUrl}`);
			return `[${linkText}](${normalizedUrl} "Invalid URL - Please check.")`;
		}

		return `[${linkText}](${normalizedUrl})`;
	});
};

const fixSpacedUrl = (text: string) => {
	// Match markdown links: [text](url)
	const spacedLinkRegex = /\[\s*([^\]]+?)\s*\]\s*\(\s*([^\)]+?)\s*\)/g;

	return text.replace(spacedLinkRegex, (match, linkText, url) => {
		// Clean up spaces only around the URL part, not the link text
		const fixedLinkText = linkText.replace(/\s+/g, ""); // Remove spaces from link text (if any)
		const fixedUrl = url.replace(/\s+/g, ""); // Remove spaces from the URL part

		return `[${fixedLinkText}](${fixedUrl})`; // Rebuild the link
	});
};

const preprocessLaTeX = (content: string) => {
	// Replace block-level LaTeX delimiters \[ \] with $$ $$
	const blockRegex = /\\\[([\s\S]*?)\\\]/g;
	const blockProcessedContent = content.replace(
	  blockRegex,
	  (_, equation) => `$$${equation}$$`
	);
  
	// Replace inline LaTeX delimiters \( \) with $ $
	const inlineRegex = /\\\(([\s\S]*?)\\\)/g;
	const inlineProcessedContent = blockProcessedContent.replace(
	  inlineRegex,
	  (_, equation) => `$${equation}$`
	);
  
	return inlineProcessedContent;
};
	

// Update the preprocessContent function
const preprocessContent = (text: string) => {
	// First, fix any spaced URLs in the content
	const spaceCorrectedText = fixSpacedUrl(text);

	// Then process links normally (to validate them)
	const linksCorrectedText = processLinks(spaceCorrectedText);

	const processedText = preprocessLaTeX(linksCorrectedText);
	return processedText;
};

const MarkdownDisplay: React.FC<{ content: string }> = ({ content }) => {
	const components = {
		h1: ({ children, ...props }: React.ComponentProps<"h1">) => (
			<h1
				className='text-[1.35rem] font-semibold mt-10 mb-6 text-gray-80 font-inter'
				{...props}>
				{children}
			</h1>
		),
		h2: ({ children, ...props }: React.ComponentProps<"h2">) => (
			<h2
				className='text-[1.25rem] font-semibold mt-8 mb-4 text-gray-80 font-inter'
				{...props}>
				{children}
			</h2>
		),
		h3: ({ children, ...props }: React.ComponentProps<"h3">) => (
			<h3
				className='text-[1.125rem] font-semibold mt-6 mb-3 text-gray-80 font-inter'
				{...props}>
				{children}
			</h3>
		),
		ul: ({ children, ...props }: React.ComponentProps<"ul">) => (
			<ul
				className='my-4 ml-6 space-y-3 list-disc text-[1rem] font-inter'
				{...props}>
				{children}
			</ul>
		),
		ol: ({ children, ...props }: React.ComponentProps<"ol">) => (
			<ol
				className='my-4 ml-6 space-y-3 list-decimal text-[1rem] font-inter'
				{...props}>
				{children}
			</ol>
		),
		code: ({
			// inline,
			className,
			children,
			...props
		}: React.HTMLAttributes<HTMLElement> & { inline?: boolean; }) => {
			const language = className?.replace("language-", "");
			const inline = !className?.includes("language");
			if (inline) {
				return (
					<code
						className='px-2 py-1 bg-gray-100 rounded-md font-mono text-base overflow-auto'
						{...props}>
						{children}
					</code>
				);
			}
			return (
				<CodeBlock
					language={language || "text"}
					value={String(children).replace(/\n$/, "")}
				/>
			);
		},
		math: ({ inline, value }: MathComponentProps) => (
			<span
				className={
					inline
						? "math math-inline font-inter"
						: "math math-display font-inter"
				}
				dangerouslySetInnerHTML={{ __html: value || "" }}
			/>
		),
		blockquote: (props: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
			<blockquote
				className='border-l-4 border-purple-400 pl-4 my-4 italic text-gray-600 text-[1rem] font-inter'
				{...props}
			/>
		),
		table: ({ children, ...props }: React.ComponentProps<"table">) => (
			<div className='my-4 overflow-x-auto'>
				<table
					className='min-w-full divide-y divide-gray-200 font-inter'
					{...props}>
					{children}
				</table>
			</div>
		),
		th: ({ children, ...props }: React.ComponentProps<"th">) => (
			<th
				className='px-6 py-3 bg-gray-50 text-left text-[1rem] font-semibold text-gray-500 uppercase tracking-wider font-inter'
				{...props}>
				{children}
			</th>
		),
		td: ({ children, ...props }: React.ComponentProps<"td">) => (
			<td
				className='px-6 py-4 whitespace-nowrap text-[1rem] text-gray-500 font-inter'
				{...props}>
				{children}
			</td>
		),
		a: ({
			children,
			href,
			...props
		}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
			const normalizedHref = href ? normalizeUrl(href) : href;
			return (
				<a
					href={normalizedHref}
					className='text-primary hover:underline decoration-2 font-inter'
					target='_blank'
					rel='noopener noreferrer'
					{...props}>
					{children}
				</a>
			);
		},
		img: ({
			children,
			...props
		}: React.ImgHTMLAttributes<HTMLImageElement>) => {
			return (
				// eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
				<img
					className='w-auto my-4 max-h-[15rem] rounded-lg'
					{...props}>
					{children}
				</img>
			);
		},
		p: ({ children, ...props }: React.ComponentProps<"p">) => {
			const isSourceParagraph = String(children).startsWith("Sources:");
			if (isSourceParagraph) {
				const processedContent = String(children).replace(
					/\[(.*?)\]\((.*?)\)/g,
					(match, text, url) => `[${text}](${normalizeUrl(url)})`
				);
				return (
					<div
						className='w-full my-4 leading-4 text-gray-600 text-[1rem] font-inter'
						{...props}>
						{processedContent}
					</div>
				);
			}
			return (
				<div
					className='w-full my-4 text-gray-600 text-[1rem] font-inter'
					{...props}>
					{children}
				</div>
			);
		},
		/*
		Alert: ({
			children,
			type = "info",
			...props
		}: {
			children: React.ReactNode;
			type?: string;
		}) => (
			<Alert className='my-4 font-inter' {...props}>
				<AlertTitle>{type === "info" ? "Note" : type.toUpperCase()}</AlertTitle>
				{children}
			</Alert>
		),
		*/
	};

	// Preprocess the content to handle links before rendering it
	const processedContent = preprocessContent(content);

	return (
		<div className='w-full prose prose-purple font-inter text-[1rem] [&_td]:py-2 [&_td]:text-gray-80 [&_thead_th]:bg-transparent [&_thead_th]:text-gray-80'>
			<EnhancedReactMarkdown
				components={components}
				remarkPlugins={[remarkMath, remarkGfm]}
				rehypePlugins={[rehypeKatex]}
				className='markdown-content'>
				{processedContent}
			</EnhancedReactMarkdown>
		</div>
	);
};

export default MarkdownDisplay;

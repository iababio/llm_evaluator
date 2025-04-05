import React, { FC, memo } from "react";
import dynamic from "next/dynamic";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { CodeBlock } from "./code-block";
import remarkGfm from "remark-gfm";
import type { Options } from "react-markdown";
import Image from "next/image"; // Import Next.js Image component

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
});

// Fix 1: Add display name to the memoized component
export const EnhancedReactMarkdown: FC<Options> = memo(
  (props) => <ReactMarkdown {...props} />,
  (prevProps: Readonly<Options>, nextProps: Readonly<Options>) =>
    prevProps.children === nextProps.children
);
// Add display name
EnhancedReactMarkdown.displayName = 'EnhancedReactMarkdown';

interface MathComponentProps extends React.HTMLAttributes<HTMLDivElement> {
	value?: string;
	inline?: boolean;
}

const normalizeUrl = (url: string) => {
	const cleanUrl = url.replace(/\s+/g, "");

	return cleanUrl;
};

const isValidUrl = (url: string) => {
	try {
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

const processLinks = (text: string) => {
	const urlRegex = /\[(.*?)\]\((.*?)\)/g;
	return text.replace(urlRegex, (match, linkText, url) => {
		const normalizedUrl = normalizeUrl(url);

		if (!isValidUrl(normalizedUrl)) {
			console.warn(`Invalid URL: ${normalizedUrl}`);
			return `[${linkText}](${normalizedUrl} "Invalid URL - Please check.")`;
		}

		return `[${linkText}](${normalizedUrl})`;
	});
};

const fixSpacedUrl = (text: string) => {
	const spacedLinkRegex = /\[\s*([^\]]+?)\s*\]\s*\(\s*([^\)]+?)\s*\)/g;

	return text.replace(spacedLinkRegex, (match, linkText, url) => {
		const fixedLinkText = linkText.replace(/\s+/g, ""); // Remove spaces from link text (if any)
		const fixedUrl = url.replace(/\s+/g, ""); // Remove spaces from the URL part

		return `[${fixedLinkText}](${fixedUrl})`; // Rebuild the link
	});
};

const preprocessLaTeX = (content: string) => {
	const blockRegex = /\\\[([\s\S]*?)\\\]/g;
	const blockProcessedContent = content.replace(
	  blockRegex,
	  (_, equation) => `$$${equation}$$`
	);
  
	const inlineRegex = /\\\(([\s\S]*?)\\\)/g;
	const inlineProcessedContent = blockProcessedContent.replace(
	  inlineRegex,
	  (_, equation) => `$${equation}$`
	);
  
	return inlineProcessedContent;
};
	

const preprocessContent = (text: string) => {
	const spaceCorrectedText = fixSpacedUrl(text);

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
			src,
			alt = "Markdown image", // Fix 3: Provide default alt text
			...props
		}: React.ImgHTMLAttributes<HTMLImageElement>) => {
			// Only use Next/Image for absolute URLs, as Next/Image requires absolute URLs
			if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
				return (
					<div className="w-auto my-4 max-h-[15rem]">
						{/* Fix 2: Use Next/Image component for optimization */}
						<Image 
							src={src}
							alt={alt || "Markdown image"}
							width={500}
							height={300}
							className="rounded-lg"
							style={{ objectFit: 'contain', maxHeight: '15rem' }}
						/>
					</div>
				);
			}			
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
	};

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

// Fix 1: Add display name to the component
MarkdownDisplay.displayName = 'MarkdownDisplay';

export default MarkdownDisplay;

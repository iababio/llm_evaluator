import { FC, memo } from "react";
import ReactMarkdown, { Options } from "react-markdown";

export const MemoizedReactMarkdown: FC<Options> = memo(
  ReactMarkdown,
  (prevProps: Readonly<Options>, nextProps: Readonly<Options>) =>
    prevProps.children === nextProps.children,
);

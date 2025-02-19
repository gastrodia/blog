import Datetime from "./Datetime";
import type { BlogFrontmatter } from "@content/_schemas";

export interface Props {
  href?: string;
  frontmatter: BlogFrontmatter;
  secHeading?: boolean;
}

export default function Card({ href, frontmatter, secHeading = true }: Props) {
  const { title, pubDatetime, description } = frontmatter;
  return (
    <li className="my-6">
      <a
        href={href}
        className="block  border border-skin-line p-4 hover:outline-dashed"
      >
        {secHeading ? (
          <h2 className="text-lg font-medium text-skin-accent">{title}</h2>
        ) : (
          <h3 className="text-lg font-medium">{title}</h3>
        )}

        <Datetime datetime={pubDatetime} />
        <p>{description}</p>
      </a>
    </li>
  );
}

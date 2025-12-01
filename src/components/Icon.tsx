export interface Props {
  name: string;
  className?: string | Array<string | Record<string, boolean>>;
  id?: string;
}

const classListToString = (classList: string | Array<string | Record<string, boolean>> | undefined): string | undefined => {
  if (!classList) return undefined;
  if (typeof classList === 'string') return classList;
  
  return classList
    .map(item => {
      if (typeof item === 'string') return item;
      return Object.entries(item)
        .filter(([_, value]) => value)
        .map(([key]) => key)
        .join(' ');
    })
    .filter(Boolean)
    .join(' ');
};

export const Icon = ({ name, className, id }: Props) => {
  return (
    <svg className={classListToString(className)} id={id}>
      <use xlinkHref={`#${name}`} />
    </svg>
  )
}
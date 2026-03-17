import * as React from "react";
import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio";

function AspectRatio({
  ...props
}: React.ComponentPropsWithoutRef<typeof AspectRatioPrimitive.Root> & {
  children?: React.ReactNode;
}) {
  return <AspectRatioPrimitive.Root data-slot="aspect-ratio" {...props} />;
}

export { AspectRatio };

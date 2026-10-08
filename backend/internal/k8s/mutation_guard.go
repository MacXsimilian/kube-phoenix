package k8s

import "context"

// SetMutationGuard installs the process ownership check before workers start.
func (c *Client) SetMutationGuard(guard func(context.Context) error) { c.mutationGuard = guard }
func (c *Client) checkMutation(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if c.mutationGuard != nil {
		return c.mutationGuard(ctx)
	}
	return nil
}

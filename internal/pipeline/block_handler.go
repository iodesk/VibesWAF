package pipeline

import (
	"github.com/iodesk/VibesWAF/internal/pages"
)


type BlockHandler struct{}


func NewBlockHandler() *BlockHandler {
	return &BlockHandler{}
}


func (h *BlockHandler) Handle(ctx *Context) error {

	if ctx.Action != "block" {
		return nil
	}


	reason := ctx.Reason
	if reason == "" {
		reason = "Security policy violation detected"
	}

	pages.ServeBlockedPage(ctx.Writer, ctx.ClientIP, ctx.Request.Host, reason)
	

	return ErrResponseWritten
}

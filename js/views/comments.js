import { watchComments, addComment, deleteComment } from "../store.js";
import { el, setPending, confirmDialog, friendlyError } from "../ui.js";
import { relativeTime } from "../lib/dates.js";

/**
 * Renders a comment thread for one target (§7.4). The compose box lives outside
 * the list that gets replaced on each snapshot, so typing is never wiped (§8).
 * Returns { element, unsubscribe }.
 */
export function renderComments({ tripId, targetType, targetId, myUid, usersById }) {
  const toggleBtn = el("button", { type: "button", className: "comments-toggle", textContent: "Comments" });
  const body = el("div", { className: "comments-body", hidden: true });
  const list = el("ul", { className: "comments-list" });
  const errorHolder = el("div", { className: "field-error-holder" });
  const textarea = el("textarea", { className: "comment-input", rows: 2, placeholder: "Write a comment…" });
  const submitBtn = el("button", { type: "button", className: "btn btn-small btn-primary", textContent: "Comment" });

  function authorName(uid) {
    return (usersById[uid] && usersById[uid].displayName) || "Someone";
  }

  submitBtn.addEventListener("click", async () => {
    const text = textarea.value.trim();
    errorHolder.replaceChildren();
    if (!text) return;
    if (text.length > 2000) {
      errorHolder.replaceChildren(
        el("p", { className: "field-error", textContent: "Comments are limited to 2000 characters." })
      );
      return;
    }
    setPending(submitBtn, true, "Posting…");
    try {
      await addComment(tripId, { targetType, targetId, text, uid: myUid });
      textarea.value = "";
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(submitBtn, false);
    }
  });

  toggleBtn.addEventListener("click", () => {
    body.hidden = !body.hidden;
  });

  function renderList(comments) {
    toggleBtn.textContent = comments.length ? `Comments (${comments.length})` : "Comments";
    if (comments.length === 0) {
      list.replaceChildren(el("li", { className: "comments-empty", textContent: "No comments yet." }));
      return;
    }
    list.replaceChildren(
      ...comments.map((comment) => {
        const when = comment.createdAt && comment.createdAt.toDate ? relativeTime(comment.createdAt.toDate()) : "";
        const item = el("li", { className: "comment" }, [
          el("p", { className: "comment-text", textContent: comment.text }),
          el("p", { className: "comment-meta", textContent: `${authorName(comment.addedBy)} · ${when}` }),
        ]);
        if (comment.addedBy === myUid) {
          const deleteBtn = el("button", { type: "button", className: "btn btn-link", textContent: "Delete" });
          deleteBtn.addEventListener("click", async () => {
            const confirmed = await confirmDialog("Delete this comment?");
            if (!confirmed) return;
            try {
              await deleteComment(tripId, comment.id);
            } catch (err) {
              errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
            }
          });
          item.appendChild(deleteBtn);
        }
        return item;
      })
    );
  }

  const unsubscribe = watchComments(
    tripId,
    targetType,
    targetId,
    renderList,
    (err) => list.replaceChildren(el("li", { className: "field-error", textContent: friendlyError(err) }))
  );

  body.append(list, errorHolder, el("div", { className: "comment-form" }, [textarea, submitBtn]));

  return { element: el("div", { className: "comments" }, [toggleBtn, body]), unsubscribe };
}

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import NotificationBell, { NotificationBellProps } from "@/app/components/NotificationBell";
import {
  Default,
  WithUnreadBadge,
  HighUnreadCount,
  OpenWithNotifications,
  OpenEmpty,
  LoadingState,
  ErrorState,
  Disabled,
  AllRead,
} from "@/app/components/NotificationBell.stories";

describe("NotificationBell Storybook stories — rendering validation", () => {
  it("renders Default story correctly", () => {
    render(<NotificationBell {...(Default.args as NotificationBellProps)} />);
    expect(screen.getByTestId("notification-bell")).toHaveAttribute(
      "data-status",
      "read"
    );
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
  });

  it("renders WithUnreadBadge story correctly", () => {
    render(<NotificationBell {...(WithUnreadBadge.args as NotificationBellProps)} />);
    expect(screen.getByTestId("notification-bell")).toHaveAttribute(
      "data-status",
      "unread"
    );
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("3");
  });

  it("renders HighUnreadCount story correctly", () => {
    render(<NotificationBell {...(HighUnreadCount.args as NotificationBellProps)} />);
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("99+");
  });

  it("renders OpenWithNotifications story correctly", () => {
    render(<NotificationBell {...(OpenWithNotifications.args as NotificationBellProps)} />);
    expect(screen.getByTestId("notification-dropdown")).toBeInTheDocument();
    expect(screen.getByText("Milestone Approved")).toBeInTheDocument();
    expect(screen.getByText("Payout Received")).toBeInTheDocument();
    expect(screen.getByText("Dispute Opened")).toBeInTheDocument();
  });

  it("renders OpenEmpty story correctly", () => {
    render(<NotificationBell {...(OpenEmpty.args as NotificationBellProps)} />);
    expect(screen.getByTestId("notification-dropdown")).toBeInTheDocument();
    expect(screen.getByTestId("notification-empty")).toBeInTheDocument();
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("renders LoadingState story correctly", () => {
    render(<NotificationBell {...(LoadingState.args as NotificationBellProps)} />);
    expect(screen.getByTestId("notification-dropdown")).toBeInTheDocument();
    expect(screen.getByTestId("notification-loading")).toBeInTheDocument();
    expect(screen.getByText("Loading notifications…")).toBeInTheDocument();
  });

  it("renders ErrorState story correctly", () => {
    render(<NotificationBell {...(ErrorState.args as NotificationBellProps)} />);
    expect(screen.getByTestId("notification-dropdown")).toBeInTheDocument();
    expect(screen.getByTestId("notification-error")).toBeInTheDocument();
    expect(
      screen.getByText("Failed to connect to notification service. Please try again.")
    ).toBeInTheDocument();
  });

  it("renders Disabled story correctly", () => {
    render(<NotificationBell {...(Disabled.args as NotificationBellProps)} />);
    expect(screen.getByTestId("notification-bell")).toBeDisabled();
    expect(screen.getByTestId("notification-bell")).toHaveAttribute(
      "data-status",
      "disabled"
    );
    expect(screen.queryByTestId("notification-dropdown")).not.toBeInTheDocument();
  });

  it("renders AllRead story correctly", () => {
    render(<NotificationBell {...(AllRead.args as NotificationBellProps)} />);
    expect(screen.getByTestId("notification-dropdown")).toBeInTheDocument();
    expect(screen.getByText("Milestone Approved")).toBeInTheDocument();
    expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument();
  });
});

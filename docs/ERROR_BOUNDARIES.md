# React Error Boundary Specifications

React Error Boundaries wrap main navigation routes to prevent white-screen crashes.

<ErrorBoundary fallback={<ErrorFallbackUI />}>
  <GameRoomView />
</ErrorBoundary>

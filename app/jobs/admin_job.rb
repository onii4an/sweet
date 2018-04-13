class AdminJob < ApplicationJob
  queue_as :default

  def perform(action_name, args)
    send(action_name.to_sym, *args) if respond_to?(action_name.to_sym, :include_private)
  end

  private

  def report(id)
    ActionCable.server.broadcast 'admin', action: :report, id: id.to_i
  end
end

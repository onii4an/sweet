class ConversationChannel < ApplicationCable::Channel
  def subscribed
    stream_from "user_#{current_user.id}" unless current_user.type == "Admin"
  end

  def unsubscribed
    current_user.update waiting: false unless current_user.type == "Admin"
    # Any cleanup needed when channel is unsubscribed
  end
end

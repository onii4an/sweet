class ConversationChannel < ApplicationCable::Channel
  def subscribed
    stream_from "boy_#{current_boy.id}" if current_boy
    stream_from "girl_#{current_girl.id}" if current_girl
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
